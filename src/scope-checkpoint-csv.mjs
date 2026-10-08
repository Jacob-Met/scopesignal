import { MAX_CHECKPOINTS, draftBudget, validateScopeDraft } from './scope-plan.mjs';
import { MAX_WORKSPACE_BYTES, encodeScopeWorkspace } from './scope-workspace-record.mjs';

export const MAX_CHECKPOINT_CSV_BYTES = MAX_WORKSPACE_BYTES;
export const CHECKPOINT_DRAFT_FILENAME = 'scopesignal-checkpoint-draft-v1.json';
const HEADER = ['deliverable', 'amount', 'evidence'];

export class CheckpointCsvError extends Error {
  constructor(code, message, record = null) {
    super(message);
    this.name = 'CheckpointCsvError';
    this.code = code;
    this.record = record;
  }
}

export function decodeCheckpointCsv(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new CheckpointCsvError('CSV_INPUT', 'Choose a UTF-8 CSV file.');
  }
  if (bytes.byteLength > MAX_CHECKPOINT_CSV_BYTES) {
    throw new CheckpointCsvError('CSV_SIZE', 'Choose a CSV file no larger than 1 MiB.');
  }
  let text;
  try {
    // Keep the BOM visible so only one leading encoding marker is consumed.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new CheckpointCsvError('CSV_UTF8', 'The CSV file must contain valid UTF-8 text.');
  }
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  if (!text.length) throw new CheckpointCsvError('CSV_EMPTY', 'The CSV file is empty.');

  const records = [];
  let fields = [], value = '', quoted = false, closedQuote = false, endedRecord = false;
  const failure = (code, message) => {
    throw new CheckpointCsvError(code, message, records.length + 1);
  };
  const field = () => {
    fields.push(value);
    if (fields.length > HEADER.length) {
      failure('CSV_COLUMNS', 'CSV record ' + (records.length + 1) + ' must have exactly three columns.');
    }
    value = '';
    closedQuote = false;
  };
  const record = () => {
    field();
    if (fields.length !== HEADER.length) {
      failure('CSV_COLUMNS', 'CSV record ' + (records.length + 1) + ' must have exactly three columns.');
    }
    if (!records.length && fields.some((item, index) => item !== HEADER[index])) {
      failure('CSV_HEADER', 'Use the exact header deliverable,amount,evidence in that order.');
    }
    if (records.length === MAX_CHECKPOINTS + 1) {
      failure('CSV_ROWS', 'Use between 1 and 12 checkpoint rows after the header.');
    }
    records.push(fields);
    fields = [];
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else {
        // Embedded field line breaks are preserved. The unchanged workspace
        // encoder will refuse CR or a line break in a single-line field.
        value += char;
      }
      endedRecord = false;
    } else if (char === ',') {
      field();
      endedRecord = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r') {
        if (text[index + 1] !== '\n') {
          failure('CSV_SYNTAX', 'Use LF or CRLF between CSV records; a bare carriage return is not a separator.');
        }
        index++;
      }
      record();
      endedRecord = true;
    } else if (closedQuote) {
      failure('CSV_SYNTAX', 'CSV record ' + (records.length + 1) + ' has text after a closing quote.');
    } else if (char === '"') {
      if (value.length) {
        failure('CSV_SYNTAX', 'CSV record ' + (records.length + 1) + ' has a quote inside an unquoted field.');
      }
      quoted = true;
      endedRecord = false;
    } else {
      value += char;
      endedRecord = false;
    }
  }
  if (quoted) failure('CSV_SYNTAX', 'CSV record ' + (records.length + 1) + ' has an unclosed quoted field.');
  if (!endedRecord) record();
  if (records.length < 2) {
    throw new CheckpointCsvError('CSV_ROWS', 'Use between 1 and 12 checkpoint rows after the header.');
  }
  return records.slice(1).map(([title, amount, evidence]) => ({ title, amount, evidence }));
}

export function prepareCheckpointDraft(bytes, metadata) {
  const checkpoints = decodeCheckpointCsv(bytes);
  const draft = {
    label: metadata?.label,
    brief: metadata?.brief,
    cap: metadata?.cap,
    checkpoints
  };
  let contents;
  try {
    // Native admission is authoritative, including unfinished amounts and
    // exact text limits. No review, approval or payment event is constructed.
    contents = encodeScopeWorkspace({ draft });
  } catch (error) {
    throw new CheckpointCsvError('DRAFT_FIELDS', error.message);
  }
  return {
    draft,
    contents,
    budget: draftBudget(draft),
    validation: validateScopeDraft(draft)
  };
}

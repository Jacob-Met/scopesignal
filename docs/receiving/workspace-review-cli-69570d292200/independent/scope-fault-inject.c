#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

/* Reviewer-only fault injection, confined to one supplied output parent.
 * No application source or global process limits are modified. */
static int phase_is(const char *wanted) {
  const char *phase = getenv("SCOPE_REVIEW_PHASE");
  return phase && strcmp(phase, wanted) == 0;
}
static int private_file(const char *path) {
  const char *guard = getenv("SCOPE_REVIEW_GUARD");
  if (!path || !guard || guard[0] != '/') return 0;
  size_t n = strlen(guard), length = strlen(path);
  const char *prefix = "/.scopesignal-review-";
  const char *suffix = "/review.html";
  return strncmp(path, guard, n) == 0
    && strncmp(path + n, prefix, strlen(prefix)) == 0
    && length >= strlen(suffix)
    && strcmp(path + length - strlen(suffix), suffix) == 0;
}
static int fd_is_private(int fd, char *path) {
  char proc[64];
  int n = snprintf(proc, sizeof(proc), "/proc/self/fd/%d", fd);
  if (n < 0 || (size_t)n >= sizeof(proc)) return 0;
  ssize_t length = readlink(proc, path, PATH_MAX - 1);
  if (length < 0) return 0;
  path[length] = '\0';
  return private_file(path);
}
static void record(const char *phase, const char *path) {
  struct stat st;
  long long bytes = stat(path, &st) == 0 ? (long long)st.st_size : -1;
  fprintf(stderr, "SCOPE_REVIEW_INJECT phase=%s bytes=%lld\n", phase, bytes);
}
int fsync(int fd) {
  int (*real_call)(int) = dlsym(RTLD_NEXT, "fsync");
  char path[PATH_MAX];
  if (phase_is("sync") && fd_is_private(fd, path)) {
    record("sync", path); errno = EIO; return -1;
  }
  return real_call(fd);
}
int link(const char *from, const char *to) {
  int (*real_call)(const char *, const char *) = dlsym(RTLD_NEXT, "link");
  const char *target = getenv("SCOPE_REVIEW_TARGET");
  if (phase_is("link") && private_file(from) && target && strcmp(to, target) == 0) {
    record("link", from); errno = EIO; return -1;
  }
  return real_call(from, to);
}
int unlink(const char *path) {
  int (*real_call)(const char *) = dlsym(RTLD_NEXT, "unlink");
  const char *target = getenv("SCOPE_REVIEW_TARGET");
  struct stat source, published;
  if (phase_is("cleanup") && private_file(path) && target
    && stat(path, &source) == 0 && stat(target, &published) == 0
    && source.st_dev == published.st_dev && source.st_ino == published.st_ino) {
    record("cleanup", path); errno = EIO; return -1;
  }
  return real_call(path);
}

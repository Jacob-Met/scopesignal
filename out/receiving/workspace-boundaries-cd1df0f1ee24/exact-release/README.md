# Exact merged Pages release

The actual PR22 merge 65d47f90e609c36f51648c303e06f74a1d95f856 passed all 116 tests and the automatic Pages deployment. Both jobs logged that exact checkout. The deployment created artifact 11552422018 and reported success; complete job logs and API metadata are retained here.

[Release receipt](receiving.json), [test log](pages-test.log), [deployment log](pages-deploy.log), [API metadata](release-metadata.json), and [independent actual public browser receiving](../public-65d/README.md).

The public receiver used normal HTTPS, matched all eight required runtime bodies before navigation, matched all 32 browser response bodies during the two actual save/open routes, and preserved three downloads and two inspected screenshots. Its timestamp bounds the served-source observation.

This evidence-only branch preserves the post-release result without changing any application file or rerunning Pages. Every one of the 312 merged parent leaves remains exact. The original source, baseline failures and candidate receiving remain under the same receiving directory in the parent.

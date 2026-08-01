# Numerical Tolerance Policy

Reference outputs are generated with Python 3.12 and `pyblp==1.2.0`. The POC compares finite numerical leaves with `abs_tol=1e-9` and `rel_tol=1e-9`; all identity, version, input-digest, schema, no-write sentinel, and artifact fields are exact. A tolerance comparison is evidence of numerical reproducibility only. It does not authorize calibration, runtime activation, or truth writes.

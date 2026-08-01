# Numerical Tolerance Policy

Reference outputs are generated with Python 3.12 and `pyblp==1.2.0`. The POC compares finite numerical leaves with `abs_tol=1e-9` and `rel_tol=1e-9`; identity, version, input-digest, schema, and the no-write sentinel are exact. Each output's `artifact_digest` is validated as an exact digest of that output, but is not compared to a frozen digest across hosts because it intentionally includes numerical leaves. A tolerance comparison is evidence of numerical reproducibility only. It does not authorize calibration, runtime activation, or truth writes.

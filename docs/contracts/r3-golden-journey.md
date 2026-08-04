# R3 Golden Journey Contract

The R3 integration surface is a closed, read-oriented projection over the
existing D1, R7, M1, D2, D3, D4, D5 and D6 authorities. It carries exact
references, request/correlation identifiers, receipts and allowed actions so a
Teacher can inspect one synthetic journey without introducing another writer.

`JSON_INTERNAL_ONLY` remains the only active runtime authority. The integration
surface cannot write Truth, SettlementResult, Score, Rank or Replay authority.
Student projections set `student_private_fields_exposed=false` and never carry
teacher-only D2 evidence or private raw event payloads.

The JSON Schema checks closed structural shapes. Cross-reference equality,
tenant scope and lifecycle semantics remain the responsibility of the existing
domain services and their tests.

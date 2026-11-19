# Prescribed sets are created one training week at a time

Activating a block creates only week 1's prescribed sets. Each Sunday review then creates the next week's sets with progressed loads. We chose this over creating the whole block at activation, because loads come from weekly double progression, so future weeks would hold loads that are guessed and then overwritten. As a result, `prescribed_sets` never holds future weeks, and anything showing "the rest of the block" has to work it out from day templates rather than read it from the table.

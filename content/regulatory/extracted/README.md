# Extractions from an instrument — NOT serving bundles

Everything in this directory is a faithful reading of a government instrument
that **nothing in the product serves yet**. It sits here rather than one level
up for a reason that cost a real regression to learn.

Eight readers glob `content/regulatory/*.json` and treat every file they find
as certified serving coverage: the species readiness report, the dimension
matrix, the provenance tests, the source-URL check, and more. When Ontario's
open seasons were first written there, the readiness report changed in both
wrong directions at once — deer, moose, bear and turkey lost RESOLVED dimensions
because the new rules do not carry limits or conditions, and **elk went
NOT_RESEARCHED → RESOLVED, which claimed coverage for a species nothing serves.**

§8 requires capability reporting to measure deliverable answers rather than
encoded records. An extraction is a record. It becomes an answer when it is
certified and wired into the engine, and on that day it moves up a directory.

The globs here are non-recursive, so a file in this folder is invisible to all
eight readers and to any reader written later — no reader has to learn a flag,
and the safe behaviour is the default.

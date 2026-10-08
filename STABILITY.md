# Stable Alpha Rollback Point

`main` is the project's most stable, completely working alpha build and the
baseline for future development. New changes and fixes should continue from
`main`, preserving this known-good point as a rollback option if later work
causes a regression.

The current site baseline is commit `83c19b2` (`Stabilize app features and
cross-device sync`). Keep that commit in the branch history when adding future
work so it remains available for rollback.

// Key inside the strategy-tester `entries` map that holds the extra-row ids
// (entries.__rows[strategyId][dateKey] = [ids]). Lives here, not in the
// store, so the read-only share viewer can use it without loading the store.
export const ROWS_KEY = '__rows'

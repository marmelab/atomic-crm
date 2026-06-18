# Sorting

**Task:** "Sort this array of numbers."

## Without Ponytail

```js
function quickSort(arr, compareFn = (a, b) => a - b) {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = [];
  const right = [];
  const equal = [];

  for (const item of arr) {
    const cmp = compareFn(item, pivot);
    if (cmp < 0) left.push(item);
    else if (cmp > 0) right.push(item);
    else equal.push(item);
  }

  return [
    ...quickSort(left, compareFn),
    ...equal,
    ...quickSort(right, compareFn),
  ];
}

const sorted = quickSort(numbers);
```

A hand-rolled quicksort. It allocates three arrays per recursion level, blows the stack on large inputs, and replaces an engine-optimized native sort with homework.

## With Ponytail

```js
// ponytail: this exists
numbers.sort((a, b) => a - b)
```

**24 lines → 1 line.** Every runtime ships a sort tuned by people whose whole job is sorting. Use it.

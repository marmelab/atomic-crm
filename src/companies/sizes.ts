export const sizes = [
  {
    id: 1,
    name: "1 employee",
    value: {
      "size@gte": 1,
      "size@lte": 1,
    },
  },
  {
    id: 10,
    name: "2-9 employees",
    value: {
      "size@gte": 2,
      "size@lte": 9,
    },
  },
  {
    id: 50,
    name: "10-49 employees",
    value: {
      "size@gte": 10,
      "size@lte": 49,
    },
  },
  {
    id: 250,
    name: "50-249 employees",
    value: {
      "size@gte": 50,
      "size@lte": 249,
    },
  },
  {
    id: 500,
    name: "250 or more employees",
    value: {
      "size@gte": 250,
      "size@lte": undefined,
    },
  },
];

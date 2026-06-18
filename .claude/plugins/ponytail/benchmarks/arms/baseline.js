// Baseline arm: no skill, just the task.
module.exports = ({ vars }) => [{ role: "user", content: vars.task }];

export function installWarningFilter(): void {
  process.removeAllListeners("warning");
  process.on("warning", (warning: Error) => {
    if (warning.name === "ExperimentalWarning" && /sqlite/i.test(warning.message)) {
      return;
    }
    process.stderr.write(`${warning.name}: ${warning.message}\n`);
  });
}

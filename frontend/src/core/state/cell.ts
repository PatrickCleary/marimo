/* Copyright 2023 Marimo. All rights reserved. */
import { logNever } from "@/utils/assertNever";
import { CellMessage } from "../kernel/messages";
import { CellState } from "../model/cells";
import { collapseConsoleOutputs } from "../model/collapseConsoleOutputs";
import { parseOutline } from "../dom/outline";

export function transitionCell(
  cell: CellState,
  message: CellMessage
): CellState {
  const nextCell = { ...cell };

  // Handle status transition and update output; message.status !== null
  // implies a status transition
  switch (message.status) {
    case "queued":
      nextCell.interrupted = false;
      nextCell.errored = false;
      // We intentionally don't update lastCodeRun, since the kernel queues
      // whatever code was last registered with it, which might not match
      // the cell's current code if the user modified it.
      break;
    case "running":
      // If was previously stopped, clear the outputs
      if (cell.stopped) {
        nextCell.output = null;
      }
      nextCell.stopped = false;
      nextCell.runStartTimestamp = message.timestamp;
      break;
    case "idle":
      if (cell.runStartTimestamp) {
        nextCell.runElapsedTimeMs =
          (message.timestamp - cell.runStartTimestamp) * 1000;
        nextCell.runStartTimestamp = null;
      }
      break;
    case null:
      break;
    case "stale":
      // Everything should already be up to date from prepareCellForExecution
      break;
    case "disabled-transitively":
      // Everything should already be up to date from prepareCellForExecution
      break;
    default:
      logNever(message.status);
  }
  nextCell.output = message.output ?? nextCell.output;
  nextCell.status = message.status ?? nextCell.status;

  // Handle errors: marimo includes an error output when a cell is interrupted
  // or errored
  if (
    message.output !== null &&
    message.output.mimetype === "application/vnd.marimo+error"
  ) {
    if (message.output.data.some((error) => error["type"] === "interruption")) {
      // This cell needs to be re-run, even if its code contents haven't
      // changed since it was last run. Force the re-run state by clearing
      // its lastCodeRun
      nextCell.lastCodeRun = null;
      nextCell.interrupted = true;
    } else if (
      message.output.data.some((error) => error["type"] === "ancestor-stopped")
    ) {
      // The cell didn't run, but it was intentional, so don't count as
      // errored.
      nextCell.stopped = true;
      // Update elapsed time, since it is still useful to know how long before
      // the cell was stopped.
      nextCell.runElapsedTimeMs = cell.runStartTimestamp
        ? (message.timestamp - cell.runStartTimestamp) * 1000
        : null;
    } else {
      nextCell.errored = true;
      // Update elapsed time, since it is still useful to know how long before
      // the cell was stopped.
      nextCell.runElapsedTimeMs = cell.runStartTimestamp
        ? (message.timestamp - cell.runStartTimestamp) * 1000
        : null;
    }
  }

  // Coalesce console outputs, which are streamed during execution.
  let consoleOutputs = cell.consoleOutputs;
  if (message.console !== null) {
    // The kernel sends an empty array to clear the console; otherwise,
    // message.console is an output that needs to be appended to the
    // existing console outputs.
    consoleOutputs = Array.isArray(message.console)
      ? message.console
      : collapseConsoleOutputs([...cell.consoleOutputs, message.console]);
  }
  nextCell.consoleOutputs = consoleOutputs;
  // Derive outline from output
  nextCell.outline = parseOutline(nextCell.output);
  return nextCell;
}

// Should be called when a cell's code is registered with the kernel for
// execution.
export function prepareCellForExecution(cell: CellState): CellState {
  const nextCell = { ...cell };

  nextCell.interrupted = false;
  nextCell.errored = false;
  nextCell.edited = false;
  nextCell.runElapsedTimeMs = null;
  nextCell.lastCodeRun = cell.code.trim();

  return nextCell;
}

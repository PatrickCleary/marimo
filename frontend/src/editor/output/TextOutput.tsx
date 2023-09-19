/* Copyright 2023 Marimo. All rights reserved. */

import { OutputChannel } from "@/core/kernel/messages";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  channel?: OutputChannel;
}

export const TextOutput = ({ text, channel }: Props): JSX.Element => {
  return (
    <span
      className={cn(
        "whitespace-pre",
        channel === "output" && "font-prose",
        channel
      )}
    >
      {text}
    </span>
  );
};

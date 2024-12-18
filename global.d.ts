import { Message } from "@prisma/client";
import type { MessageAttachment } from "types";

declare global {
  interface IMessage extends Message {
    createdAt: string;
    attachments?: MessageAttachment[]
  }
}

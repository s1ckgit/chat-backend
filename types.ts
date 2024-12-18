

export type MessageAttachment = {
  previewUrl: string;
  originalUrl: string;
}

export interface Ityping_event_data {
  userId: string; 
  conversationId: string;
}

export interface Isend_message_event_data extends IMessage {
  receiverId: string;
}

export interface Imessages_read_event_data {
  ids: string[]; 
  conversationId: string;
}

export interface Irequest_unread_event_data {
  conversationId: string;
}

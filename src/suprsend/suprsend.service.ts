import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Suprsend, Event } from '@suprsend/node-sdk';

interface ISuprsendEvent {
  distinct_id: string;
  event_name: string;
  properties?: Record<string, unknown>;
}

interface ISuprsendUserInstance {
  add_email(email: string): void;
  save(): Promise<any>;
}

interface ISuprsendClient {
  track_event(event: ISuprsendEvent): Promise<{
    success: boolean;
    status: string;
    status_code: number;
    message: string;
  }>;
  user: {
    get_instance(distinct_id: string): ISuprsendUserInstance;
  };
}

const SafeSuprsend = Suprsend as unknown as new (
  key: string,
  secret: string,
) => ISuprsendClient;

const SafeEvent = Event as unknown as new (
  distinct_id: string,
  event_name: string,
  properties?: Record<string, unknown>,
) => ISuprsendEvent;

@Injectable()
export class SuprSendService implements OnModuleInit {
  private readonly logger = new Logger(SuprSendService.name);

  private suprsendClient: ISuprsendClient | null = null;

  onModuleInit() {
    const apiKey = process.env.SUPRSEND_WORKSPACE_KEY;
    const apiSecret = process.env.SUPRSEND_WORKSPACE_SECRET;

    if (!apiKey || !apiSecret) {
      this.logger.warn(
        'SuprSend credentials are missing in environment variables!',
      );
      return;
    }

    this.suprsendClient = new SafeSuprsend(apiKey, apiSecret);
  }

  async sendSchoolInviteNotification(payload: {
    recipientUserId: string;
    recipientEmail: string;
    schoolName: string;
    inviteId: string;
    customMessage?: string;
    schoolEmail: string;
    instructorName: string;
    inviteUrl: string;
    expiryDays: number;
  }) {
    if (!this.suprsendClient) {
      this.logger.warn('SuprSend client is not initialized. Skipping event.');
      return;
    }

    try {
      try {
        const user = this.suprsendClient.user.get_instance(
          payload.recipientEmail,
        );
        user.add_email(payload.recipientEmail);
        await user.save();
      } catch (profileError) {
        const errorMessage =
          profileError instanceof Error
            ? profileError.message
            : String(profileError);

        this.logger.warn(
          `Failed to update SuprSend profile for ${payload.recipientEmail}: ${errorMessage}`,
        );
      }

      const event = new SafeEvent(
        payload.recipientEmail,
        'SCHOOL_INVITE_CREATED',
        {
          $email: [payload.recipientEmail],
          school_name: payload.schoolName,
          school_email: payload.schoolEmail,
          instructor_name: payload.instructorName,
          invite_url: payload.inviteUrl,
          invite_id: payload.inviteId,
          custom_message: payload.customMessage,
          expiry_days: payload.expiryDays,
          year: new Date().getFullYear(),
        },
      );

      const response = await this.suprsendClient.track_event(event);

      this.logger.log(
        `SuprSend invite notification triggered for email: ${payload.recipientEmail}`,
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to trigger SuprSend notification', error);
    }
  }
}

export type InviteEmailDebugClassification =
  | 'network_error'
  | 'cors_blocked_suspected'
  | 'route_not_found'
  | 'unauthorized'
  | 'server_error'
  | 'bad_request'
  | 'empty_response'
  | 'non_json_response'
  | 'unknown';

export type InviteEmailDebugBundle = {
  appContext: {
    appVersion: string;
    commitSha: string;
    buildTime: string;
    environment: string;
    origin: string;
    userAgent: string;
  };
  correlation: {
    clientTimestampUtc: string;
    clientRequestId: string;
    traceId: string;
    groupId: string;
  };
  request: {
    method: 'POST';
    url: string;
    requestHeaders: {
      contentType: string;
      accept: string;
      origin: string;
      hasSessionHeader: boolean;
    };
    requestBody: {
      recipientEmail: string;
      recipientName?: string;
      personalMessageLen: number;
      personalMessagePreview?: string;
      traceId: string;
    };
  };
  networkOutcome: {
    fetchErrorName?: string;
    fetchErrorMessage?: string;
    httpStatus?: number;
    httpStatusText?: string;
    responseHeaders: {
      contentType?: string;
      server?: string;
      xMsRequestId?: string;
      requestContext?: string;
      date?: string;
    };
    responseBodyText?: string;
    responseBodyLen?: number;
    contentType?: string;
    jsonParseError?: string;
    timing: {
      startMs: number;
      endMs: number;
      durationMs: number;
    };
  };
  diagnostics: {
    classification: InviteEmailDebugClassification;
    suggestions: string[];
  };
};

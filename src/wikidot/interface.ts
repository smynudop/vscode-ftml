/**
 * Represents the metadata of a Wikidot page at a certain revision.
 */
export interface PageMetadata {
  site: string;
  page: string;
  title?: string;
  parent?: string;
  tags?: string[] | string;
  revision?: number;
  exist?: boolean;
}

/**
 * Represents the source and metadata of a Wikidot page at a certain revision.
 */
export interface PageData extends PageMetadata {
  source: string;
  comments?: string;
}

/**
 * Represents a response from Wikidot ajax endpoint.
 */
export interface Response {
  status: string;
  CURRENT_TIMESTAMP: number;
  callbackIndex: string;
  message?: string;
  body?: any;
  jsInclude?: string[];
  cssInclude?: string[];
  [x: string]: unknown;
}

/**
 * Represents a Wikidot user session.
 * Strings are cookie content.
 */
export interface Session {
  /**
   * A session cookie id assigned by Wikidot.
   */
  session_id: string;
  /**
   * A date string indicating when the session expires.
   */
  session_expire: string;
  /**
   * A Date object constructed from session_expire for convenience.
   */
  session_expire_date: Date;
  /**
   * A cookie string containing session_id and additional cookie "wikidot_udsession=1".
   */
  session_auth: string;
}
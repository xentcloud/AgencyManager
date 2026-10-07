/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as changeRequests from "../changeRequests.js";
import type * as dev from "../dev.js";
import type * as email_transport from "../email/transport.js";
import type * as forms from "../forms.js";
import type * as github_app from "../github/app.js";
import type * as githubEvents from "../githubEvents.js";
import type * as http from "../http.js";
import type * as inbound from "../inbound.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_edgeAuth from "../lib/edgeAuth.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as organizations from "../organizations.js";
import type * as sites from "../sites.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  changeRequests: typeof changeRequests;
  dev: typeof dev;
  "email/transport": typeof email_transport;
  forms: typeof forms;
  "github/app": typeof github_app;
  githubEvents: typeof githubEvents;
  http: typeof http;
  inbound: typeof inbound;
  "lib/access": typeof lib_access;
  "lib/edgeAuth": typeof lib_edgeAuth;
  "lib/hmac": typeof lib_hmac;
  organizations: typeof organizations;
  sites: typeof sites;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};

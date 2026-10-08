import { afterAll, afterEach, beforeAll } from "vitest";
import { setupServer } from "msw/node";

// Tests add handlers with server.use(). Any request without one fails the test.
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

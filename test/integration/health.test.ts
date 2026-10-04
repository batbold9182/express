import request from "supertest";
import mongoose from "mongoose";
import app from "../../backend/app";

// mongoose.connection.readyState is a non-configurable accessor, so jest.spyOn can't wrap it.
// Shadow it with an own property on the connection instead; afterEach removes the shadow so the real value shows again.
const setReadyState = (state: number) =>
    Object.defineProperty(mongoose.connection, "readyState", { get: () => state, configurable: true });

afterEach(() => {
    delete (mongoose.connection as { readyState?: number }).readyState;
});

describe("GET /health", () => {
    it("returns 200 OK when the database is connected", async () => {
        setReadyState(1); // connected
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ok: true, db: "connected" });
    });

    it("returns 503 Service Unavailable when the database is disconnected", async () => {
        setReadyState(0); // disconnected
        const response = await request(app).get("/health");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ ok: false, db: "disconnected" });
    });

    // Only state 1 counts as healthy. Every other Mongoose state must report 503.
    it.each<[number, string]>([
        [2, "connecting"],
        [3, "disconnecting"],
        [99, "uninitialized"],
    ])("returns 503 when readyState is %i (%s)", async (state) => {
        setReadyState(state);
        const response = await request(app).get("/health");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ ok: false, db: "disconnected" });
    });
});

import * as mailer from "../../backend/lib/mailer";

/**
 * Stands in for the password-reset email. Call it once at the top of any test file that reaches forgot-password.
 *
 *   const mail = useMailerMock();
 *   await request(app).post("/auth/forgot-password").send({ email });
 *   const token = mail.tokenFor(email);          // the plaintext token the user would have clicked
 *
 * Nothing is sent. The app stores only a hash of the token and puts the plaintext in the email alone, so this is the
 * only way a test can obtain it. (test/setup/noRealMail.ts fails any test that tries to send real mail without this.)
 */
export function useMailerMock() {
    const sent: { to: string; token: string }[] = [];

    beforeEach(() => {
        sent.length = 0;
        jest.spyOn(mailer, "sendPasswordReset").mockImplementation(async (to, token) => {
            sent.push({ to: String(to), token });
        });
    });

    return {
        /** Every reset email "sent" during this test, oldest first. */
        sent,
        /** The most recent plaintext reset token mailed to `email`, or undefined if none was. */
        tokenFor(email: string) {
            const mine = sent.filter((m) => m.to === email);
            return mine[mine.length - 1]?.token;
        },
    };
}

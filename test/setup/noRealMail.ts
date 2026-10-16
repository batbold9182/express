// Runs before every test file, after the test framework is installed (jest.config.js → setupFilesAfterEnv).
//
// No test may send real email. forgot-password mails a live reset link through Gmail, and the mailer has no console
// fallback, so a test that reaches it without a mock would mail whoever's address it used.
//
//  1. The Gmail credentials are removed from the environment, so there is nothing to send with.
//  2. `nodemailer.createTransport` throws, and the throw is counted. A route that fires the mail without waiting
//     swallows the error (`.catch(console.error)`), so the count is checked after each test and FAILS the test
//     that forgot to call `useMailerMock()`.
delete process.env.GMAIL_USER;
delete process.env.GMAIL_PASS;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require("nodemailer");

export const realMail = { attempts: 0 };

nodemailer.createTransport = () => {
    realMail.attempts++;
    throw new Error("A test tried to send real email. Call useMailerMock() at the top of the test file.");
};

afterEach(() => {
    const attempts = realMail.attempts;
    realMail.attempts = 0;
    if (attempts > 0) {
        throw new Error(`${attempts} attempt(s) to send real email during this test. Call useMailerMock() at the top of the file.`);
    }
});

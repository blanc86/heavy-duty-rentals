"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/lib/auth/actions";
import { Alert, Button, Card, CardBody, Hint, Input, Label } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";

/**
 * Change password.
 *
 * The server action behind this was written, guarded and audited, and revokes
 * every OTHER session on success — a password change is how someone evicts an
 * attacker, and that only works if it kills the attacker's session. It simply
 * had no form, so the one control a compromised account needs was unreachable.
 *
 * Nothing here validates the password itself. The strength policy lives on the
 * server, where it also runs for registration, and a second copy in the browser
 * would be one more thing to drift out of step for no security benefit.
 */
export function ChangePassword({ dict }: { dict: Dictionary }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      setDone(false);

      const result = await changePasswordAction({
        currentPassword: current,
        newPassword: next,
      });

      if (result.ok) {
        setCurrent("");
        setNext("");
        setDone(true);
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-2 text-lg font-bold text-steel-950">{dict.account.changePassword}</h2>
        <p className="mb-4 text-sm text-steel-600">{dict.account.changePasswordBody}</p>

        {done && (
          <Alert tone="available" className="mb-4">
            {dict.account.passwordChanged}
          </Alert>
        )}
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="currentPassword" required>
              {dict.account.currentPassword}
            </Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="newPassword" required>
              {dict.account.newPassword}
            </Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
            <Hint>{dict.auth.passwordHelp}</Hint>
          </div>

          <Button type="submit" disabled={isPending || !current || !next}>
            {isPending ? dict.common.loading : dict.account.changePassword}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/** Shown inside admin confirmation dialogs so the operator can verify the target account. */
export function AdminUserIdentityBlock({
  name,
  email,
  userId,
}: {
  name: string;
  email: string | null;
  userId: string;
}) {
  return (
    <div className="mt-3 space-y-1.5 rounded-md border bg-muted/40 px-3 py-2 text-left text-sm">
      <p>
        <span className="text-muted-foreground">Name: </span>
        <span className="font-medium text-foreground">{name}</span>
      </p>
      <p>
        <span className="text-muted-foreground">Email: </span>
        <span className="text-foreground">{email ?? "—"}</span>
      </p>
      <p className="break-all">
        <span className="text-muted-foreground">User ID: </span>
        <span className="font-mono text-xs text-foreground">{userId}</span>
      </p>
    </div>
  );
}

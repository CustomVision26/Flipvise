export function TeacherNameFieldHelpContent() {
  return (
    <>
      <p className="mb-1 font-semibold">Examples:</p>
      <ul className="space-y-1 text-xs">
        <li>
          • <span className="font-semibold">Name:</span> Mathematics
        </li>
        <li>
          • <span className="font-semibold">Name:</span> Jamaican History
        </li>
        <li>
          • <span className="font-semibold">Name:</span> French to English
        </li>
      </ul>
    </>
  );
}

export function TeacherTopicFieldHelpContent() {
  return (
    <>
      <p className="mb-1 font-semibold">Be specific to help AI understand:</p>
      <ul className="space-y-1.5 text-xs">
        <li>
          <span className="font-semibold">Name:</span>{" "}
          <span className="font-medium">Mathematics</span>
          <br />
          <span className="font-semibold">Topic:</span> Algebra, Geometry, or Calculus
        </li>
        <li>
          <span className="font-semibold">Name:</span>{" "}
          <span className="font-medium">Jamaican History</span>
          <br />
          <span className="font-semibold">Topic:</span> Learning Jamaica&apos;s independence and
          national identity
        </li>
        <li>
          <span className="font-semibold">Name:</span>{" "}
          <span className="font-medium">French to English</span>
          <br />
          <span className="font-semibold">Topic:</span> Everyday French phrases and vocabulary
        </li>
      </ul>
    </>
  );
}

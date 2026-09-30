export default function StatusBadge({ status }) {
  const label = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    FETCH_FAILED: 'Fetch Failed',
  }[status] || status;

  return (
    <span className={`badge badge-${status?.toLowerCase()}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

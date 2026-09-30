import { ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import PlatformIcon from './PlatformIcon';

export default function EvidenceTable({ evidence, onUpdated }) {

  function formatDate(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <div>
          <h2>Detailed Stats</h2>
          <p>Only verified platforms count towards marks</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Status</th>
              <th>Total Solved</th>
              <th>SQL Solved</th>
              <th>Fetched</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((row) => (
              <tr key={row.id} style={{ opacity: row.verified ? 1 : 0.6 }}>
                <td>
                  <PlatformIcon platform={row.platform} platformLabel={row.platformLabel} />
                </td>
                <td>
                  {row.verified ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                      <CheckCircle size={14} />
                      Verified
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--warning)', fontSize: '13px', fontWeight: 600 }}>
                      <AlertCircle size={14} />
                      Not Verified
                    </span>
                  )}
                </td>
                <td>
                  <span className="num-highlight" style={!row.verified ? { textDecoration: 'line-through', opacity: 0.5 } : {}}>
                    {row.totalProblemsSolved}
                  </span>
                  {!row.verified && <span style={{ fontSize: '11px', color: 'var(--warning)', marginLeft: '5px' }}>*</span>}
                </td>
                <td>
                  <span className="num-highlight" style={!row.verified ? { textDecoration: 'line-through', opacity: 0.5 } : {}}>
                    {row.sqlProblemsSolved}
                  </span>
                  {!row.verified && <span style={{ fontSize: '11px', color: 'var(--warning)', marginLeft: '5px' }}>*</span>}
                </td>
                <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {formatDate(row.fetchedAt)}
                </td>
                <td>
                  <a
                    href={row.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-icon"
                    title="Open profile"
                  >
                    <ExternalLink size={14} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
          {evidence.some(e => !e.verified) && (
            <tfoot>
              <tr>
                <td colSpan={6} style={{ fontSize: '12px', color: 'var(--warning)', padding: '10px 15px' }}>
                  * Unverified platform counts are shown but NOT included in your marks. Verify your profiles to get credit.
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

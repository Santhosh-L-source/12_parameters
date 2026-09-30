const OpensourceEvidence = require('./src/models/OpensourceEvidence');
const sequelize = require('./src/config/database');

async function cleanup() {
  try {
    console.log('Cleaning up duplicate GitHub PR entries...');

    // Find all students with MERGED_PR entries
    const allPRs = await OpensourceEvidence.findAll({
      where: { achievementType: 'MERGED_PR' },
      order: [['createdAt', 'DESC']],
    });

    // Group by student
    const byStudent = {};
    allPRs.forEach(pr => {
      if (!byStudent[pr.studentId]) {
        byStudent[pr.studentId] = [];
      }
      byStudent[pr.studentId].push(pr);
    });

    let deletedCount = 0;
    let updatedCount = 0;

    // For each student, keep only the latest one and delete others
    for (const studentId in byStudent) {
      const prs = byStudent[studentId];

      if (prs.length > 1) {
        // Keep the first (most recent) one, delete the rest
        const [keep, ...toDelete] = prs;

        // Update the one we're keeping to use consistent naming
        await keep.update({
          repoOrProgrammeName: 'GitHub Contributions',
        });
        updatedCount++;

        // Delete duplicates
        for (const pr of toDelete) {
          await pr.destroy();
          deletedCount++;
          console.log(`  Deleted duplicate for student ${studentId}: ${pr.repoOrProgrammeName}`);
        }
      } else if (prs.length === 1) {
        // Update to use consistent naming
        await prs[0].update({
          repoOrProgrammeName: 'GitHub Contributions',
        });
        updatedCount++;
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Updated: ${updatedCount} entries`);
    console.log(`   Deleted: ${deletedCount} duplicates`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  }
}

cleanup();

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const CompetitionEvidence = sequelize.define(
  'CompetitionEvidence',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    studentId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'student_id',
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    eventName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'event_name',
    },
    stage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'stage',
      comment: 'COMPLETED, PRELIMINARY, INTERMEDIATE, REGIONAL_FINALIST, NATIONAL_FINALIST, NATIONAL_WINNER',
    },
    level: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'level',
      comment: 'College, Regional/State, National, International',
    },
    achievementStage: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'achievement_stage',
      comment: 'Legacy field',
    },
    stageMarks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'stage_marks',
    },
    proofUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: 'proof_url',
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'PENDING',
      validate: { isIn: [STATUSES] },
      comment: 'PENDING, VERIFIED (fully verified), REJECTED',
    },
    websiteVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'website_verified',
      comment: 'True if website/automated verification passed',
    },
    mentorVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'mentor_verified',
      comment: 'True if mentor verification passed',
    },
    websiteVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'website_verified_at',
    },
    mentorId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'mentor_id',
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
      comment: 'When fully verified (both website and mentor)',
    },
  },
  {
    tableName: 'competition_evidence',
    underscored: true,
    indexes: [
      { fields: ['student_id', 'event_name', 'achievement_stage'], unique: true },
    ],
  }
);

module.exports = CompetitionEvidence;

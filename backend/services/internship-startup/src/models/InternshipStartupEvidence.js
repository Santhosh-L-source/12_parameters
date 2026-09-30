const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { VALID_TRACKS, ALL_STAGES } = require('../config/stages');

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

const InternshipStartupEvidence = sequelize.define(
  'InternshipStartupEvidence',
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
    track: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [VALID_TRACKS] },
    },
    processOrStartupName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'process_or_startup_name',
    },
    achievementStage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'achievement_stage',
      validate: { isIn: [Object.keys(ALL_STAGES)] },
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
      type: DataTypes.STRING(20),
      defaultValue: 'PENDING',
      validate: { isIn: [STATUSES] },
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
    },
  },
  {
    tableName: 'internship_startup_evidence',
    underscored: true,
    indexes: [
      {
        fields: ['student_id', 'process_or_startup_name', 'achievement_stage'],
        unique: true,
      },
    ],
  }
);

module.exports = InternshipStartupEvidence;

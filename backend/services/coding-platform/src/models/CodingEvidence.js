const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'FETCH_FAILED'];

const CodingEvidence = sequelize.define(
  'CodingEvidence',
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
    platform: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    platformLabel: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'platform_label',
    },
    profileUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: 'profile_url',
    },
    totalProblemsSolved: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_problems_solved',
    },
    sqlProblemsSolved: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sql_problems_solved',
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'PENDING',
      validate: { isIn: [STATUSES] },
    },
    fetchedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fetched_at',
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
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    externalUsername: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'external_username',
    },
  },
  {
    tableName: 'coding_evidence',
    underscored: true,
    indexes: [
      { fields: ['student_id', 'platform'], unique: true },
    ],
  }
);

module.exports = CodingEvidence;

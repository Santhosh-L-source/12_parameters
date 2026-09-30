const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const STATUSES = ['PENDING', 'VERIFIED', 'EXPIRED', 'FAILED'];

const VerificationAttempt = sequelize.define(
  'VerificationAttempt',
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
    platform: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profileUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: 'profile_url',
    },
    externalUsername: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'external_username',
    },
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'token_hash',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'PENDING',
      validate: { isIn: [STATUSES] },
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
    },
  },
  {
    tableName: 'verification_attempts',
    underscored: true,
    indexes: [
      { fields: ['student_id', 'platform'] },
    ],
  }
);

module.exports = VerificationAttempt;

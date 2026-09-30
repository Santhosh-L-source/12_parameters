const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CPRatingEvidence = sequelize.define(
  'CPRatingEvidence',
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
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    currentRating: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'current_rating',
    },
    proofUrl: {
      type: DataTypes.STRING(512),
      allowNull: false,
      field: 'proof_url',
    },
    fetchedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fetched_at',
    },
  },
  {
    tableName: 'cp_rating_evidence',
    underscored: true,
    indexes: [
      { fields: ['student_id', 'platform'], unique: true },
    ],
  }
);

module.exports = CPRatingEvidence;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define(
  'Student',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    rollNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'roll_number',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'password_hash',
    },
  },
  {
    tableName: 'students',
    underscored: true,
  }
);

Student.prototype.toSafeJSON = function () {
  const values = this.toJSON();
  delete values.passwordHash;
  return values;
};

module.exports = Student;

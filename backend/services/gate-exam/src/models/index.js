const sequelize = require('../config/database');
const defineGateEvidence = require('./GateEvidence');
const defineGateBranchCalibration = require('./GateBranchCalibration');

const GateEvidence = defineGateEvidence(sequelize);
const GateBranchCalibration = defineGateBranchCalibration(sequelize);

module.exports = { sequelize, GateEvidence, GateBranchCalibration };

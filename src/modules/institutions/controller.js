const institutionsService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createInstitution = async (req, res) => {
  const institution = await institutionsService.createInstitution({
    tenantId: req.auth.tenantId,
    payload: req.body,
  });

  sendResponse(res, 201, { institution });
};

const listInstitutions = async (req, res) => {
  const institutions = await institutionsService.listInstitutions({
    tenantId: req.auth.tenantId,
    query: req.query,
  });

  sendResponse(res, 200, { institutions });
};

const getInstitutionById = async (req, res) => {
  const institution = await institutionsService.getInstitutionById({
    tenantId: req.auth.tenantId,
    institutionId: req.params.id,
  });

  sendResponse(res, 200, { institution });
};

const updateInstitution = async (req, res) => {
  const institution = await institutionsService.updateInstitution({
    tenantId: req.auth.tenantId,
    institutionId: req.params.id,
    payload: req.body,
  });

  sendResponse(res, 200, { institution });
};

const archiveInstitution = async (req, res) => {
  const institution = await institutionsService.archiveInstitution({
    tenantId: req.auth.tenantId,
    institutionId: req.params.id,
  });

  sendResponse(res, 200, { institution });
};

module.exports = {
  createInstitution,
  listInstitutions,
  getInstitutionById,
  updateInstitution,
  archiveInstitution,
};

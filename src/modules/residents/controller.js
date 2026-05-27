const residentsService = require('./service');

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createResident = async (req, res) => {
  const resident = await residentsService.createResident({
    tenantId: req.auth.tenantId,
    payload: req.body,
  });

  sendResponse(res, 201, { resident });
};

const listResidents = async (req, res) => {
  const residents = await residentsService.listResidents({
    tenantId: req.auth.tenantId,
    query: req.query,
  });

  sendResponse(res, 200, { residents });
};

const getResidentById = async (req, res) => {
  const resident = await residentsService.getResidentById({
    tenantId: req.auth.tenantId,
    residentId: req.params.id,
    user: req.user,
  });

  sendResponse(res, 200, { resident });
};

const updateResident = async (req, res) => {
  const resident = await residentsService.updateResident({
    tenantId: req.auth.tenantId,
    residentId: req.params.id,
    payload: req.body,
  });

  sendResponse(res, 200, { resident });
};

const archiveResident = async (req, res) => {
  const resident = await residentsService.archiveResident({
    tenantId: req.auth.tenantId,
    residentId: req.params.id,
  });

  sendResponse(res, 200, { resident });
};

module.exports = {
  createResident,
  listResidents,
  getResidentById,
  updateResident,
  archiveResident,
};

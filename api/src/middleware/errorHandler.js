export function notFound(req,res) {
  res.status(404).json({success:false,error:{code:'NOT_FOUND',message:`Route ${req.method} ${req.path} was not found.`}});
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  const code = err.code || 'INTERNAL_ERROR';
  const status = err.status || 500;
  res.status(status).json({success:false,error:{code,message:err.publicMessage || 'An unexpected server error occurred.'}});
}

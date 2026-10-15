import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({success:false,error:{code:'UNAUTHENTICATED',message:'Authentication is required.'}});
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({success:false,error:{code:'INVALID_TOKEN',message:'Your session is invalid or expired.'}});
  }
}

export function requireRole(...roles) {
  return (req,res,next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({success:false,error:{code:'FORBIDDEN',message:'You do not have permission for this operation.'}});
    }
    next();
  };
}

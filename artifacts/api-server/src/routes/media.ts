/**
 * Public media serving route — restricted to the managed uploads namespace ONLY.
 * Only serves objects whose path matches: uploads/<uuid>
 * This prevents exposing any other private objects in the bucket.
 *
 * GET /media/objects/uploads/:uuid
 */
import { Router, type Request, type Response } from 'express';
import { ObjectStorageService, ObjectNotFoundError } from '../lib/objectStorage.js';

const router = Router();
const svc = new ObjectStorageService();

// UUID v4 pattern — reject any key that isn't a bare UUID to prevent path traversal
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/media/objects/uploads/:uuid', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUuid = req.params.uuid;
    const uuid = Array.isArray(rawUuid) ? rawUuid[0] : rawUuid;
    if (!uuid || !UUID_RE.test(uuid)) {
      res.status(400).json({ error: 'Invalid media key' });
      return;
    }
    // Maps to PRIVATE_OBJECT_DIR/uploads/<uuid> via getObjectEntityFile
    const objectPath = `/objects/uploads/${uuid}`;
    const file = await svc.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (metadata.size) res.setHeader('Content-Length', String(metadata.size));
    const nodeStream = file.createReadStream();
    nodeStream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    nodeStream.pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

export default router;

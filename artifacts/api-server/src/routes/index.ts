import { Router, type IRouter } from "express";
import contentRouter from "./content";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);

export default router;

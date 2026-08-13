import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import contactRouter from "./contact";
import contentRouter from "./content";
import healthRouter from "./health";
import mediaRouter from "./media";
import registerRouter from "./register";
import seoRouter from "./seo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contentRouter);
router.use(contactRouter);
router.use(registerRouter);
router.use("/admin", adminRouter);
router.use(mediaRouter);
router.use(seoRouter);

export default router;

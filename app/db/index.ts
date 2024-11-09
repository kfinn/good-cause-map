import { Sequelize } from "sequelize";

const sequelize = new Sequelize(
  "postgresql://nycdb:nycdb@localhost:54321/nycdb"
);
export default sequelize;

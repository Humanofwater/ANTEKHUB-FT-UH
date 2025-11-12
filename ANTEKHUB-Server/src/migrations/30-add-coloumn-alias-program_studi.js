module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("program_studi", "alias", {
            type: Sequelize.ARRAY(Sequelize.STRING(200)),
            allowNull: true,
            defaultValue: [],
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn("program_studi", "alias");
    }
}
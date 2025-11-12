'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('referensi_perusahaan', {
      id:   { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      uuid: { type: Sequelize.UUID,  allowNull: false, defaultValue: Sequelize.literal('uuid_generate_v4()') },

      nama_perusahaan: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(255), allowNull: true, unique: true },

      jenis_perusahaan_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'jenis_institusi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      bidang_industri_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'bidang_industri', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      perusahaan_negara_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'bangsa', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      perusahaan_provinsi_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'provinsi', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      perusahaan_kabupaten_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'kabupaten_kota', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      perusahaan_alamat: { type: Sequelize.STRING(255), allowNull: false },
      longitude: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        validate: {
            min: -180,
            max: 180
        }
      },
      latitude: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        validate: {
            min: -90,
            max: 90
        }
      },

      alias_list: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      total_alumni: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('referensi_perusahaan', ['nama_perusahaan'], { name: 'idx_ref_perusahaan_nama' });

    await queryInterface.addConstraint('referensi_perusahaan', {
        fields: ['longitude'],
        type: 'check',
        name: 'ck_referensi_perusahaan_longitude_range',
        where: {
            longitude: { [Sequelize.Op.between]: [-180, 180] }
        }
    });

    await queryInterface.addConstraint('referensi_perusahaan', {
        fields: ['latitude'],
        type: 'check',
        name: 'ck_referensi_perusahaan_latitude_range',
        where: {
            latitude: { [Sequelize.Op.between]: [-90, 90] }
        }
    });

  },

  async down (queryInterface) {
    await queryInterface.dropTable('referensi_perusahaan');
  }
};

#!/usr/bin/env python

'''
mpirun -np 2 python pyscf_mpi.py
'''

from pyscf import gto
from pyscf import scf
from mpi4pyscf import cc as mpicc
from pyscf import cc as serial_cc
import os
import sys

def calculate_energy(atom):
    mol = gto.Mole()
    mol.atom = [
        [8 , (0. , 0.     , 0.)],
        [1 , (0. , -0.757 , 0.587)],
        [1 , (0. , 0.757  , 0.587)]]
    mol.basis = '6-31g'
    mol.verbose = 4
    mol.build()
    mf = scf.RHF(mol)
    mf.chkfile = 'h2o.chk'
    mf.run()

    mycc = mpicc.RCCSD(mf)
    mycc.diis_file = 'mpi_ccdiis.h5'
    mycc.kernel()

    mycc.restore_from_diis_('mpi_ccdiis.h5')
    mycc.kernel()


    s_cc = serial_cc.RCCSD(mf)
    s_cc.diis_file = 'serial_ccdiis.h5'
    s_cc.kernel()

    p_cc = mpicc.RCCSD(mf)
    p_cc.restore_from_diis_('serial_ccdiis.h5')
    p_cc.kernel()

    print('E_CORR: %s' % mycc.e_corr)
    print('E_CCSD: %s' % mycc.e_tot)

    return mycc.e_corr, mycc.e_tot


if __name__ == "__main__":

  if len(sys.argv) != 3:
    print_usage()
 
  ATOM = sys.argv[1]
  RESULT_FOLDER = sys.argv[2]
  CE_TASK_ID = os.environ.get('CE_TASK_ID', '0')

  e_corr, e_tot = calculate_energy(ATOM)

  filename="%s/pyscf_%s.result" % (RESULT_FOLDER, CE_TASK_ID)
  with open(filename, "w+") as f:
    f.write("e_corr: %.2f\n" % (e_corr))
    f.write("e_tot: %.2f\n" % (e_tot))
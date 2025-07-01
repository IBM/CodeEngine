from pyscf import gto, dft
mol_hf = gto.M(atom = 'H 0 0 0; F 0 0 1.1', basis = 'ccpvdz', symmetry = True)
mf_hf = dft.RKS(mol_hf)
mf_hf.xc = 'lda,vwn' # default
mf_hf = mf_hf.newton() # second-order algortihm
mf_hf.kernel()
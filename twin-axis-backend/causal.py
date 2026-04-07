
import numpy as np
import scipy.stats
import numba as nb
import numpy as np
from itertools import permutations
import pandas as pd
import scipy.io
from scipy.signal import correlate
import os
import math
import shutil
import warnings
warnings.filterwarnings('ignore')
import pickle
import time

from scipy.stats import gamma
from tqdm import tqdm
from sklearn.covariance import GraphicalLasso


# ────────────────────────────────────────────────────────────────────────────────
# Low-level ICA helpers  (unchanged from original)
# ────────────────────────────────────────────────────────────────────────────────

@nb.njit('(int_[:,::1], float64[:,::1], int_, int_)')
def get_pr(idx, r, mmax, n):
    samplesize, numvars = idx.shape
    res = np.zeros((mmax, numvars), dtype=np.float64)
    for i in range(samplesize):
        for j in range(numvars):
            res[idx[i, j] - 1, j] += (1 - r[i, j]) ** 2 / 2
            res[idx[i, j], j]     += 0.5 + r[i, j] * (1 - r[i, j])
            res[idx[i, j] + 1, j] += r[i, j] ** 2 / 2
    return res / n


@nb.njit('(int_[:,::1], float64[:,::1], float64[:,::1], float64)')
def get_psi(idx, logp, r, bandwidth):
    samplesize, numvars = idx.shape
    res = np.zeros((numvars, samplesize), dtype=np.float64)
    for i in range(samplesize):
        for j in range(numvars):
            res[j, i] += (logp[idx[i, j] - 1, j] * (1 - r[i, j]) +
                          logp[idx[i, j],     j] * (2 * r[i, j] - 1) -
                          logp[idx[i, j] + 1, j] * r[i, j])
    return res / bandwidth


def scorecond(data):
    n, numvars = data.shape
    bdwidth = 2 * (11 * np.sqrt(np.pi) / 20) ** (1 / 5) * (4 / (3 * n)) ** (1 / 5)
    data = data - data.mean(axis=0)
    T = np.sqrt((data * data).mean(axis=0))
    data = data / T
    r   = data / bdwidth
    idx = np.floor(r).astype(int)
    r   = r - idx
    idx = idx - idx.min(axis=0) + 1
    pr  = get_pr(idx, r, idx.max() + 2, n)
    logp = np.log(pr, out=np.zeros_like(pr), where=(pr != 0))
    psi  = get_psi(idx, logp, r, bdwidth)
    psi  = psi - psi.mean(axis=1)[:, None]
    lam  = (psi.T * data).sum(axis=0) / n - 1
    psi  = ((psi.T - data * lam) / T).T
    return psi


def estim_beta_pham(x):
    return -1. * scorecond(np.copy(x.T, order='C'))


def adaptive_size(grad_new, grad_old, eta_old, z_old):
    alpha = 0
    up    = 1.05
    down  = 0.8
    z     = grad_new + alpha * z_old
    etaup = (grad_new * grad_old) >= 0
    eta   = eta_old * (up * etaup + down * (1 - etaup))
    eta[eta >= 0.03] = 0.03
    return eta, z


def natural_grad_Adasize_Mask_regu(X, Mask, regu, init_W=None):
    N, T    = X.shape
    mu      = 3e-3
    itmax   = 5000
    Tol     = 1e-6
    num_edges = Mask.sum()

    if init_W is None:
        WW = np.eye(N, N)
        for i in range(N):
            Ind_i   = np.where(Mask[i] != 0)[0]
            X_Ind_i = X[Ind_i]
            WW[i, Ind_i] = -0.5 * (X[i] @ X_Ind_i.T) @ np.linalg.pinv(X_Ind_i @ X_Ind_i.T)
        W = 0.5 * (WW + WW.T)
    else:
        W = np.copy(init_W)
    W[np.diag_indices(N)] = 1

    z      = np.zeros((N, N))
    eta    = mu * np.ones_like(W)
    y_psi  = np.zeros_like(X)
    y_psi0 = np.zeros_like(X)
    Grad_W_o = None
    init_avg_gradient_curve = []
    init_loss_curve         = []

    for iter in range(itmax):
        y        = W @ X
        argsort_y = np.argsort(y, axis=1)
        if iter % 12 == 0:
            y_psi  = np.copy(estim_beta_pham(y))
            y_psi0 = np.take_along_axis(y_psi, argsort_y, axis=1)
        else:
            y_psi[(np.tile(np.arange(N), (T, 1)).T, argsort_y)] = np.copy(y_psi0)

        Grad_W_n = y_psi @ X.T / float(T) + np.linalg.inv(W.T) - 2 * regu * W
        if iter == 0:
            Grad_W_o = np.copy(Grad_W_n)
        eta, z   = adaptive_size(Grad_W_n, Grad_W_o, eta, z)
        delta_W  = eta * z
        W        = W + delta_W * Mask

        avg_gradient = np.abs(Grad_W_n * Mask).sum() / num_edges
        init_avg_gradient_curve.append(avg_gradient)
        if avg_gradient < Tol:
            break
        Grad_W_o = np.copy(Grad_W_n)

    return W, np.array(init_avg_gradient_curve), np.array(init_loss_curve)


def sparseica_W_adasize_Alasso_mask_regu(lamda, Mask, X, regu, init_W=None):
    N, T  = X.shape
    XX    = X - X.mean(axis=1)[:, None]
    std_XX = XX.std(axis=1, ddof=1)
    XX    = np.diag(1. / std_XX) @ XX
    Refine    = True
    num_edges = Mask.sum()
    mu    = 1e-3
    beta  = 0
    m     = 60
    itmax = 15000
    Tol   = 1e-6

    WW, init_avg_gradient_curve, init_loss_curve = natural_grad_Adasize_Mask_regu(XX, Mask, regu, init_W=init_W)

    omega1        = 1. / np.abs(WW[Mask != 0])
    Upper         = 3 * omega1.mean()
    omega1[omega1 > Upper] = Upper
    omega         = np.zeros((N, N))
    omega[Mask != 0] = omega1
    W             = np.copy(WW)
    z             = np.zeros((N, N))
    eta           = mu * np.ones_like(W)
    W_old         = W + np.eye(N)
    grad_new      = np.copy(W_old)
    y_psi         = np.zeros_like(XX)
    y_psi0        = np.zeros_like(XX)
    grad_old      = None
    y             = np.zeros_like(XX)
    penal_avg_gradient_curve = []
    penal_loss_curve         = []

    for iter in range(itmax):
        y            = W @ XX
        avg_gradient = np.abs(grad_new * Mask).sum() / num_edges
        penal_avg_gradient_curve.append(avg_gradient)
        if avg_gradient < Tol:
            if Refine:
                Mask   = np.abs(W) > 0.01
                Mask[np.diag_indices(N)] = 0
                lamda  = 0.
                Refine = False
            else:
                break

        argsort_y = np.argsort(y, axis=1)
        if iter % 8 == 0:
            y_psi  = np.copy(estim_beta_pham(y))
            y_psi0 = np.take_along_axis(y_psi, argsort_y, axis=1)
        else:
            y_psi[(np.tile(np.arange(N), (T, 1)).T, argsort_y)] = np.copy(y_psi0)

        dev       = omega * np.tanh(m * W)
        regu_l1   = regu / 2.
        grad_new  = (y_psi @ XX.T / T
                     + np.linalg.inv(W.T)
                     - 4 * beta * (np.diag(np.diag(y @ y.T / T)) - np.eye(N)) * (y @ XX.T / T)
                     - dev * lamda / T
                     - 2 * regu_l1 * W)
        if iter == 0:
            grad_old = np.copy(grad_new)

        eta, z   = adaptive_size(grad_new, grad_old, eta, z)
        delta_W  = eta * z
        W        = W + 0.9 * delta_W * Mask
        grad_old = np.copy(grad_new)

    W  = np.diag(std_XX) @ W  @ np.diag(1. / std_XX)
    WW = np.diag(std_XX) @ WW @ np.diag(1. / std_XX)
    y  = np.diag(std_XX) @ y
    Score = omega * np.abs(W)
    return (y, W, WW, Score,
            init_avg_gradient_curve, init_loss_curve,
            np.array(penal_avg_gradient_curve), np.array(penal_loss_curve))


def from_W_to_B(W, tol=0.02, sparsify=True):
    dd    = W.shape[0]
    W_max = np.max(np.abs(W))
    if sparsify:
        W = W * (np.abs(W) >= W_max * tol)

    P_all           = np.array(list(permutations(range(dd))))
    Num_P           = len(P_all)
    EyeI            = np.eye(dd)
    Loop_strength_bk = np.inf
    B, perm         = None, None

    for i in range(Num_P):
        W_p = W[P_all[i], :]
        if np.min(np.abs(np.diag(W_p))) != 0:
            W_p1 = np.diag(1 / np.diag(W_p)) @ W_p
            W_p2 = EyeI - W_p1
            Loop_strength = 0
            B_prod = W_p2
            for jj in range(dd - 1):
                B_prod        = B_prod @ W_p2
                Loop_strength += np.sum(np.abs(np.diag(B_prod)))
            if Loop_strength < Loop_strength_bk:
                Loop_strength_bk = Loop_strength
                B    = W_p2
                perm = P_all[i]

    return B, perm


def two_step_CD(data, num_nodes, ICA_lambda, ICA_regu=0.05,
                stablize_tol=0.02, stablize_sparsify=True,
                allowed_directed_edges=None, forbidden_directed_edges=None,
                init_mask_by_lasso=False, init_W=None):
    if init_mask_by_lasso:
        gl = GraphicalLasso()
        gl.fit(data.T)
        ICA_Mask = np.abs(gl.precision_) > 0.05 * np.max(np.abs(gl.precision_))
    else:
        ICA_Mask = np.ones((num_nodes, num_nodes))
    ICA_Mask[np.diag_indices(num_nodes)] = 0

    if allowed_directed_edges:
        for pa, ch in allowed_directed_edges:
            ICA_Mask[ch, pa] = ICA_Mask[pa, ch] = 1
    if forbidden_directed_edges:
        for pa, ch in forbidden_directed_edges:
            if (ch, pa) in forbidden_directed_edges:
                ICA_Mask[ch, pa] = ICA_Mask[pa, ch] = 0

    print('ICA_lambda: ', ICA_lambda)
    if init_W:
        _, W, _, _, _, _, _, _ = sparseica_W_adasize_Alasso_mask_regu(
            ICA_lambda, ICA_Mask, data, ICA_regu, init_W)
    else:
        _, W, _, _, _, _, _, _ = sparseica_W_adasize_Alasso_mask_regu(
            ICA_lambda, ICA_Mask, data, ICA_regu)

    adjacency_matrix, nodes_permutation = from_W_to_B(
        W, tol=stablize_tol, sparsify=stablize_sparsify)

    forbidden_edge_presented = (forbidden_directed_edges is not None and
                                any([adjacency_matrix[ch, pa] != 0
                                     for pa, ch in forbidden_directed_edges]))
    if forbidden_edge_presented:
        new_Mask = np.ones((num_nodes, num_nodes)) - np.eye(num_nodes)
        for pa, ch in forbidden_directed_edges:
            new_Mask[ch, pa] = 0
        init_W_retry = np.eye(num_nodes) - adjacency_matrix * new_Mask
        _, W, _, _, _, _, _, _ = sparseica_W_adasize_Alasso_mask_regu(
            ICA_lambda, new_Mask, data, ICA_regu, init_W_retry)
        adjacency_matrix, nodes_permutation = from_W_to_B(
            W, tol=stablize_tol, sparsify=stablize_sparsify)

    return adjacency_matrix, W, nodes_permutation


# ────────────────────────────────────────────────────────────────────────────────
# HSIC helpers  (no plotting)
# ────────────────────────────────────────────────────────────────────────────────

def rbf_kernel(X, sigma):
    G    = np.sum(X**2, axis=1)
    Q    = np.tile(G, (len(G), 1))
    R    = Q.T
    dists = Q + R - 2 * np.dot(X, X.T)
    dists = np.maximum(dists, 0)
    return np.exp(-dists / (2 * sigma**2))


def hsic(X, Y, alpha=0.05):
    m = X.shape[0]

    def median_heuristic(data):
        G     = np.sum(data**2, axis=1)
        Q     = np.tile(G, (len(G), 1))
        R     = Q.T
        dists = Q + R - 2 * np.dot(data, data.T)
        dists = dists[np.triu_indices_from(dists, k=1)]
        return np.sqrt(0.5 * np.median(dists[dists > 0]))

    sigma_x = median_heuristic(X)
    sigma_y = median_heuristic(Y)
    H       = np.eye(m) - np.ones((m, m)) / m
    K       = rbf_kernel(X, sigma_x)
    L       = rbf_kernel(Y, sigma_y)
    Kc      = H @ K @ H
    Lc      = H @ L @ H
    test_stat = (1 / m) * np.sum(Kc * Lc)
    var_hsic  = (1 / 6) * (Kc * Lc)**2
    var_hsic  = (1 / m / (m - 1)) * (np.sum(var_hsic) - np.trace(var_hsic))
    var_hsic *= 72 * (m - 4) * (m - 5) / m / (m - 1) / (m - 2) / (m - 3)
    K -= np.diag(np.diag(K))
    L -= np.diag(np.diag(L))
    mu_x      = (1 / m / (m - 1)) * np.sum(K)
    mu_y      = (1 / m / (m - 1)) * np.sum(L)
    m_hsic    = (1 / m) * (1 + mu_x * mu_y - mu_x - mu_y)
    alpha_param = m_hsic**2 / var_hsic
    beta_param  = var_hsic * m / m_hsic
    thresh      = gamma.ppf(1 - alpha, alpha_param, scale=beta_param)
    return test_stat, thresh


def compute_hsic_for_all_pairs(data):
    num_nodes   = data.shape[0]
    hsic_results = []
    for i in range(num_nodes):
        for j in range(i + 1, num_nodes):
            X = data[i, :].reshape(-1, 1)
            Y = data[j, :].reshape(-1, 1)
            test_stat, thresh = hsic(X, Y)
            hsic_results.append((i, j, test_stat, thresh))
    return hsic_results


def count_green_blocks(hsic_results, num_nodes):
    green_counts = np.zeros(num_nodes, dtype=int)
    for i, j, test_stat, thresh in hsic_results:
        if test_stat < thresh:
            green_counts[i] += 1
    total_green = green_counts.sum()
    return total_green, green_counts


def get_best_agg_factor(hsic_overall_results, num_nodes):
    """Return the L with the highest total green (independent) HSIC blocks."""
    best_L     = None
    best_green = -1
    for L, hsic_list in sorted(hsic_overall_results.items()):
        total_green, _ = count_green_blocks(hsic_list, num_nodes)
        if total_green > best_green:
            best_green = total_green
            best_L     = L
    return best_L, best_green


# ────────────────────────────────────────────────────────────────────────────────
# Main entry-point called by FastAPI backend
# ────────────────────────────────────────────────────────────────────────────────

def run_causal_analysis(filepath: str, Lmin: int, Lmax: int,
                        SET_LAMBDA: float, output_name: str,
                        output_dir: str, check_stop_callback=None) -> str:
    """
    Run causal discovery on a CSV file and save a single B_Matrix xlsx.

    Parameters
    ----------
    filepath    : path to uploaded CSV
    Lmin        : minimum aggregation window
    Lmax        : maximum aggregation window
    SET_LAMBDA  : ICA sparsity regularisation multiplier
    output_name : filename stem chosen by the user (no extension)
    output_dir  : absolute path where the output file is written

    Returns
    -------
    int – the best aggregation factor (highest green)
    """

    # ── 1. Load data ──────────────────────────────────────────────────────────
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.csv':
        df = pd.read_csv(filepath)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(filepath)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

    print(f"[causal] Loaded {filepath}: shape={df.shape}")
    print(f"[causal] Columns: {list(df.columns)}")

    # User requested specifically: timestamp, 1, 2, 3, 4, 5, 6, 7 (No 8th column)
    target_cols = ['timestamp', '1', '2', '3', '4', '5', '6', '7']
    existing_cols = [c for c in target_cols if c in df.columns]
    if existing_cols:
        df = df[existing_cols]

    # Drop non-numeric / timestamp columns automatically for the analysis
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    # Remove common timestamp-like columns by name (though user asked to 'take' it, 
    # we usually drop it for B-Matrix unless they want it as a variable)
    timestamp_like = [c for c in numeric_cols
                      if c.lower() in ('timestamp', 'time', 'index', 'id')]
    numeric_cols   = [c for c in numeric_cols if c not in timestamp_like]

    if len(numeric_cols) == 0:
        raise ValueError("No numeric columns found in the CSV file.")

    df = df[numeric_cols]
    column_names_final = list(df.columns)
    print(f"[causal] Using columns: {column_names_final}")

    M            = df.values
    ica_mask_data = df.T
    num_nodes, samplesize = ica_mask_data.shape
    print(f"[causal] num_nodes={num_nodes}, samplesize={samplesize}")

    # ── 2. Parameters ─────────────────────────────────────────────────────────
    Ni         = 0
    Nt         = df.shape[0] + Ni
    N          = Nt - Ni
    Linc       = 1
    ICA_lambda = np.log(samplesize) * SET_LAMBDA
    ICA_regu   = 0.05
    stablize_tol      = 0.02
    stablize_sparsify = True

    # ── 3. In-memory accumulators (nothing written to disk during the loop) ─────
    b_matrix_store: dict[int, np.ndarray] = {}
    hsic_store:     dict[int, list]       = {}

    # ── 5. Main loop — all computation in memory ──────────────────────────────
    for L in range(Lmin, Lmax + 1, Linc):
        if check_stop_callback and check_stop_callback():
            print(f"[causal] 🛑 Interrupted for L={L}")
            return None # Stop processing

        start_time = time.perf_counter()
        print(f"[causal] ── Loop L={L} ──")

        Nw = N // L
        print(f"[causal]   Nw (windows) = {Nw}")

        # Aggregation
        B_list  = [M[Ni:Nt, i] for i in range(num_nodes)]
        Bg_list = [[] for _ in range(num_nodes)]
        for nw in range(1, Nw + 1):
            nst = (nw - 1) * L
            for i in range(num_nodes):
                Bg = np.sum(B_list[i][nst:nst + L]) / L
                Bg_list[i].append(Bg)

        Hn = np.column_stack(Bg_list)   # (Nw, num_nodes)
        X  = Hn.T                        # (num_nodes, Nw)

        # Two-step causal discovery
        print(f"[causal]   Running two_step_CD ...")
        B_adjacency_matrix, W_m, _ = two_step_CD(
            X, num_nodes, ICA_lambda, ICA_regu,
            stablize_tol, stablize_sparsify
        )

        # HSIC independence test
        print(f"[causal]   Running HSIC ...")
        yy           = np.dot(W_m, X)
        hsic_results = compute_hsic_for_all_pairs(yy)

        # Store in memory — no disk I/O yet
        b_matrix_store[L] = B_adjacency_matrix
        hsic_store[L]     = hsic_results

        end_time = time.perf_counter()
        print(f"[causal]   Loop {L} done in {end_time - start_time:.2f}s")

    # ── 6. Pick the best L ────────────────────────────────────────────────────
    best_L, best_green = get_best_agg_factor(hsic_store, num_nodes)
    print(f"[causal] Best aggregation factor: L={best_L} (independent pairs={best_green})")

    # ── 7. Write single flat file to output_dir ───────────────────────────────
    os.makedirs(output_dir, exist_ok=True)
    prefix = output_name.strip() or "result"
    # New Naming Convention: <original_name>_BM_<aggregate_factor>__lam<lambda>-lmin<lmin>-lmax<lmax>.xlsx
    safe_name = f"{prefix}_BM_{best_L}__lam{SET_LAMBDA}-lmin{Lmin}-lmax{Lmax}.xlsx"
    output_path = os.path.join(output_dir, safe_name)

    # Save the B-Matrix for the best L
    df_b = pd.DataFrame(b_matrix_store[best_L], columns=column_names_final)
    df_b.to_excel(output_path, index=False)
    print(f"[causal] ✓ Saved B_Matrix → {output_path}")
    return best_L

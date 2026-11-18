(() => {
    'use strict';

    const GD = window.GoDegree;
    const $ = (selector, root = document) => root.querySelector(selector);

    function friendlyError(error) {
        if (error instanceof GD.ApiError) return error.message || 'The request could not be completed.';
        return error?.message || 'Something went wrong. Please try again.';
    }

    function safeHttpsUrl(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        try {
            const parsed = new URL(text);
            return parsed.protocol === 'https:' ? parsed.href : '';
        } catch (_error) {
            return '';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.body.dataset.page !== 'admin') return;
        const session = GD.getSession();
        if (!session || session.profile.role !== 'admin') return;

        const addForm = $('#admin-catalog-form');
        const editForm = $('#admin-catalog-edit-form');
        const editDialog = $('#admin-catalog-modal');
        const table = $('#admin-catalog-table');
        let catalogs = [];

        function renderCatalogs() {
            const query = ($('#admin-catalog-search').value || '').trim().toLowerCase();
            const filtered = catalogs.filter((catalog) =>
                `${catalog.catalog_year} ${catalog.file_name} ${catalog.file_url || ''}`.toLowerCase().includes(query)
            );

            $('#admin-catalog-count').textContent = `${catalogs.length} ${catalogs.length === 1 ? 'catalog' : 'catalogs'}`;

            table.innerHTML = filtered.length ? filtered.map((catalog) => {
                const safeUrl = safeHttpsUrl(catalog.file_url);
                const urlCell = safeUrl
                    ? `<a class="admin-catalog-url"
                            href="${GD.escapeHtml(safeUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open academic catalog">
                            ${GD.escapeHtml(catalog.file_url)}
                        </a>`
                    : '<span class="muted">No URL</span>';

                return `
          <tr>
            <td>${GD.escapeHtml(catalog.catalog_year)}</td>
            <td>${GD.escapeHtml(catalog.file_name)}</td>
            <td>${urlCell}</td>
            <td>
              <div class="admin-catalog-actions">
                <button class="table-action table-action--view" type="button" data-edit-catalog="${GD.escapeHtml(catalog.catalog_year)}">Edit</button>
                <button class="table-action" type="button" data-delete-catalog="${GD.escapeHtml(catalog.catalog_year)}">Delete</button>
              </div>
            </td>
          </tr>`;
            }).join('') : '<tr><td colspan="4" class="table-empty">No matching academic catalogs.</td></tr>';
        }

        async function refreshCatalogs() {
            table.innerHTML = '<tr><td colspan="4" class="table-empty">Loading academic catalogs…</td></tr>';
            try {
                const rows = await GD.api('/admin/catalogs');
                catalogs = (Array.isArray(rows) ? rows : []).map((row) => ({
                    catalog_year: String(row.catalog_year ?? row.Catalog_Year ?? ''),
                    file_name: String(row.file_name ?? row.File_Name ?? ''),
                    file_url: String(row.file_url ?? row.File_URL ?? '')
                })).sort((a, b) => b.catalog_year.localeCompare(a.catalog_year));
                renderCatalogs();
            } catch (error) {
                table.innerHTML = `<tr><td colspan="4" class="table-empty">${GD.escapeHtml(friendlyError(error))}</td></tr>`;
                GD.setMessage('admin-catalog-message', friendlyError(error));
            }
        }

        function validateUrl(value, messageId) {
            const text = String(value || '').trim();
            if (!text) return true;
            if (!safeHttpsUrl(text)) {
                GD.setMessage(messageId, 'Please enter a valid HTTPS URL.');
                return false;
            }
            return true;
        }

        addForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!addForm.reportValidity()) return;

            const catalogYear = $('#admin-catalog-year').value.trim();
            const fileName = $('#admin-catalog-file-name').value.trim();
            const fileUrl = $('#admin-catalog-file-url').value.trim();

            GD.setMessage('admin-catalog-message', '');
            if (!/^\d{4}$/.test(catalogYear)) {
                GD.setMessage('admin-catalog-message', 'Catalog year must contain exactly 4 digits.');
                return;
            }
            if (!validateUrl(fileUrl, 'admin-catalog-message')) return;

            GD.setBusy('admin-catalog-submit', true, 'Adding…');
            try {
                await GD.api('/admin/catalogs', {
                    method: 'POST',
                    body: { catalog_year: catalogYear, file_name: fileName, file_url: fileUrl || null }
                });
                GD.setMessage('admin-catalog-message', `Catalog ${catalogYear} was added successfully.`, 'success');
                addForm.reset();
                await refreshCatalogs();
            } catch (error) {
                GD.setMessage('admin-catalog-message', friendlyError(error));
            } finally {
                GD.setBusy('admin-catalog-submit', false);
            }
        });

        $('#admin-catalog-search').addEventListener('input', renderCatalogs);
        $('#admin-catalog-refresh').addEventListener('click', refreshCatalogs);

        table.addEventListener('click', async (event) => {
            const editButton = event.target.closest('[data-edit-catalog]');
            if (editButton) {
                const year = editButton.dataset.editCatalog;
                const catalog = catalogs.find((item) => item.catalog_year === year);
                if (!catalog) return;

                editForm.reset();
                GD.setMessage('admin-catalog-edit-message', '');
                $('#admin-catalog-edit-year').value = catalog.catalog_year;
                $('#admin-catalog-edit-file-name').value = catalog.file_name;
                $('#admin-catalog-edit-file-url').value = catalog.file_url;
                editDialog.showModal();
                return;
            }

            const deleteButton = event.target.closest('[data-delete-catalog]');
            if (!deleteButton) return;
            const year = deleteButton.dataset.deleteCatalog;
            if (!window.confirm(`Delete the ${year} academic catalog? This is only possible when no student account uses this catalog year.`)) return;

            deleteButton.disabled = true;
            try {
                await GD.api(`/admin/catalogs/${encodeURIComponent(year)}`, { method: 'DELETE' });
                GD.setMessage('admin-catalog-message', `Catalog ${year} was deleted.`, 'success');
                await refreshCatalogs();
            } catch (error) {
                window.alert(friendlyError(error));
                deleteButton.disabled = false;
            }
        });

        $('#admin-catalog-edit-cancel').addEventListener('click', () => editDialog.close());

        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!editForm.reportValidity()) return;

            const year = $('#admin-catalog-edit-year').value;
            const fileName = $('#admin-catalog-edit-file-name').value.trim();
            const fileUrl = $('#admin-catalog-edit-file-url').value.trim();
            GD.setMessage('admin-catalog-edit-message', '');
            if (!validateUrl(fileUrl, 'admin-catalog-edit-message')) return;

            GD.setBusy('admin-catalog-edit-submit', true, 'Saving…');
            try {
                await GD.api(`/admin/catalogs/${encodeURIComponent(year)}`, {
                    method: 'PUT',
                    body: { file_name: fileName, file_url: fileUrl || null }
                });
                editDialog.close();
                GD.setMessage('admin-catalog-message', `Catalog ${year} was updated successfully.`, 'success');
                await refreshCatalogs();
            } catch (error) {
                GD.setMessage('admin-catalog-edit-message', friendlyError(error));
            } finally {
                GD.setBusy('admin-catalog-edit-submit', false);
            }
        });

        refreshCatalogs();
    });
})();

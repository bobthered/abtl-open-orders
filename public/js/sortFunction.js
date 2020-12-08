export default th_element => {
  return (obj, index) => {
    if (obj.cells[index].querySelector('input[type="checkbox"]') !== null)
      return obj.cells[index].querySelector('input[type="checkbox"]').checked;
    if (obj.cells[index].querySelector('input[type="text"]') !== null)
      return obj.cells[index].querySelector('input[type="text"]').value;
    return obj.cells[index].innerText;
  };
};
